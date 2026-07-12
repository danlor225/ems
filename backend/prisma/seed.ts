// ============================================================
//  Seed : crée le PREMIER administrateur sur une base vierge.
//
//  Pourquoi ce script existe :
//   - /api/auth/register crée toujours un STUDENT (rôle par défaut).
//   - /api/users (création avec rôle) exige déjà d'être ADMIN.
//   => Sur une base neuve, aucun admin n'existe et aucun ne peut être
//      créé par l'API : problème de l'œuf et de la poule.
//   Ce seed débloque le tout premier compte ADMIN.
//
//  Idempotent : réexécutable sans risque (upsert sur l'email).
//  Exécution :  npm run prisma:seed   (variables ADMIN_* requises)
// ============================================================
import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// Doit correspondre au coût utilisé par AuthService (cohérence des hash).
const BCRYPT_SALT_ROUNDS = 12;

async function main(): Promise<void> {
  const email = process.env.ADMIN_EMAIL?.toLowerCase().trim();
  const password = process.env.ADMIN_PASSWORD;

  // Fail-fast : on refuse de seeder avec une config incomplète.
  if (!email || !password) {
    throw new Error(
      'ADMIN_EMAIL et ADMIN_PASSWORD sont requis pour le seed (voir .env).',
    );
  }
  if (password.length < 8) {
    throw new Error('ADMIN_PASSWORD doit faire au moins 8 caractères.');
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

  // upsert : ne recrée pas si l'admin existe déjà, ne réécrase pas son mot de passe.
  const admin = await prisma.user.upsert({
    where: { email },
    update: {}, // on ne touche à rien si le compte existe déjà
    create: {
      email,
      passwordHash,
      firstName: 'Admin',
      lastName: 'EMS',
      role: Role.ADMIN,
      isActive: true,
    },
  });

  console.log(`✅ Admin prêt : ${admin.email} (rôle : ${admin.role})`);
}

main()
  .catch((error) => {
    console.error('❌ Échec du seed :', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
