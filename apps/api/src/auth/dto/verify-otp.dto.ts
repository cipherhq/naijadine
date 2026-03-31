import { IsString, Matches, Length } from 'class-validator';

export class VerifyOtpDto {
  @IsString()
  @Matches(/^\+234[0-9]{10}$/, {
    message: 'Phone number must be a valid Nigerian number: +234XXXXXXXXXX',
  })
  phone: string;

  @IsString()
  @Length(6, 6, { message: 'OTP must be exactly 6 digits' })
  @Matches(/^[0-9]{6}$/, { message: 'OTP must contain only digits' })
  otp: string;

  @IsString()
  pin_id: string;
}
