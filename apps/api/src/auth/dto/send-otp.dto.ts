import { IsString, Matches } from 'class-validator';

export class SendOtpDto {
  @IsString()
  @Matches(/^\+234[0-9]{10}$/, {
    message: 'Phone number must be a valid Nigerian number: +234XXXXXXXXXX',
  })
  phone: string;
}
