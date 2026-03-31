import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SupabaseService } from '../config/supabase.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly supabaseService: SupabaseService,
  ) {}

  @Public()
  @Post('otp/send')
  @Throttle({ short: { ttl: 600000, limit: 3 } })
  @HttpCode(HttpStatus.OK)
  async sendOtp(@Body() dto: SendOtpDto) {
    return this.authService.sendOtp(dto.phone);
  }

  @Public()
  @Post('otp/verify')
  @Throttle({ short: { ttl: 600000, limit: 5 } })
  @HttpCode(HttpStatus.OK)
  async verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto.phone, dto.otp, dto.pin_id);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refreshToken(@Body('refresh_token') refreshToken: string) {
    return this.authService.refreshToken(refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Headers('authorization') auth: string) {
    const token = auth?.replace('Bearer ', '');
    return this.authService.logout(token);
  }

  @Get('me')
  async getMe(@CurrentUser('id') userId: string) {
    return this.authService.getProfile(userId);
  }

  // ── NDPA Compliance: Data Export ──────────────────────────
  @Get('me/data-export')
  @Throttle({ short: { ttl: 86400000, limit: 3 } }) // 3 exports per day max
  async exportMyData(@CurrentUser('id') userId: string) {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase.rpc('export_user_data', {
      target_user_id: userId,
    });

    if (error) {
      return { error: 'Failed to export data. Please try again later.' };
    }

    return { data, message: 'Your data export is ready.' };
  }

  // ── NDPA Compliance: Account Deletion ────────────────────
  @Delete('me/account')
  @HttpCode(HttpStatus.OK)
  async deleteMyAccount(@CurrentUser('id') userId: string) {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase.rpc('delete_user_data', {
      target_user_id: userId,
    });

    if (error) {
      return { error: 'Failed to process deletion. Please contact support.' };
    }

    return {
      ...data,
      message: 'Your account data has been deleted. You have been logged out.',
    };
  }
}
