import { IsString, Length } from 'class-validator';

export class VerifyBankDto {
  @IsString()
  @Length(10, 10, { message: 'Account number must be exactly 10 digits' })
  account_number: string;

  @IsString()
  bank_code: string;
}
