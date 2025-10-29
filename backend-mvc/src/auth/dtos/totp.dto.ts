import { IsString, IsNotEmpty, Length, Matches } from 'class-validator';

export class CreateTotpSetupDto {
  // No body parameters needed for setup
}

export class VerifyTotpDto {
  @IsString()
  @IsNotEmpty()
  @Length(6, 6)
  @Matches(/^\d{6}$/, { message: 'Token must be exactly 6 digits' })
  token: string;
}
