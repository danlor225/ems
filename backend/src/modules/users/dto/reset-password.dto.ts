import { IsString, MaxLength, MinLength } from 'class-validator';

export class AdminResetPasswordDto {
  @IsString()
  @MinLength(8, { message: 'Au moins 8 caractères.' })
  @MaxLength(72)
  newPassword: string;
}
