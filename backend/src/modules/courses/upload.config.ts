// ============================================================
//  Configuration de l'upload des supports de cours (multer).
//  Source unique de vérité : dossier de stockage, types MIME et
//  tailles autorisées. Partagée entre main.ts (service statique) et
//  le CoursesController (réception des fichiers).
// ============================================================
import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { Request } from 'express';
import { diskStorage } from 'multer';
import { extname, resolve } from 'path';

// Dossier absolu de stockage. En prod, on pointe UPLOADS_DIR vers un
// volume persistant (sinon Railway efface les fichiers au redéploiement).
export const UPLOADS_DIR = resolve(process.env.UPLOADS_DIR ?? 'uploads');

// Préfixe HTTP sous lequel les fichiers sont servis (voir main.ts).
export const FILES_ROUTE = '/api/files';

// Règles par type de ressource : MIME acceptés + taille max (octets).
export const UPLOAD_RULES = {
  DOCUMENT: {
    mimes: ['application/pdf', 'image/png', 'image/jpeg'],
    maxBytes: 10 * 1024 * 1024, // 10 Mo
  },
  VIDEO: {
    mimes: ['video/mp4', 'video/webm'],
    maxBytes: 100 * 1024 * 1024, // 100 Mo
  },
} as const;

export type UploadKind = keyof typeof UPLOAD_RULES;

// Plafond global confié à multer (la borne fine par type est vérifiée
// dans le service, car la taille n'est connue qu'une fois le flux reçu).
export const MAX_UPLOAD_BYTES = UPLOAD_RULES.VIDEO.maxBytes;

/** Lit et valide le paramètre ?type=DOCUMENT|VIDEO de la requête. */
export function uploadKindFromRequest(req: Request): UploadKind | null {
  const t = String(req.query.type ?? '').toUpperCase();
  return t === 'DOCUMENT' || t === 'VIDEO' ? t : null;
}

// Options passées à FileInterceptor('file', courseUploadMulter).
export const courseUploadMulter = {
  storage: diskStorage({
    destination: UPLOADS_DIR,
    // Nom aléatoire (UUID) : évite les collisions et les noms hostiles.
    filename: (_req, file, cb) =>
      cb(null, `${randomUUID()}${extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: MAX_UPLOAD_BYTES },
  fileFilter: (
    req: Request,
    file: { mimetype: string },
    cb: (error: Error | null, acceptFile: boolean) => void,
  ) => {
    const kind = uploadKindFromRequest(req);
    if (!kind) {
      return cb(
        new BadRequestException('Paramètre "type" invalide (DOCUMENT|VIDEO).'),
        false,
      );
    }
    const allowed = UPLOAD_RULES[kind].mimes as readonly string[];
    if (!allowed.includes(file.mimetype)) {
      return cb(
        new BadRequestException(
          `Type de fichier non autorisé pour ${kind}.`,
        ),
        false,
      );
    }
    cb(null, true);
  },
};
