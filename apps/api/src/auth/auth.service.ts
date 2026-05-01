import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { SupabaseService } from '../config/supabase.service';
import { OtpService } from './otp.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly otpService: OtpService,
  ) {}

  async sendOtp(phone: string) {
    const result = await this.otpService.sendOtp(phone);
    return {
      message: 'OTP sent successfully',
      pin_id: result.pin_id,
    };
  }

  async verifyOtp(phone: string, otp: string, pinId: string) {
    const { verified } = await this.otpService.verifyOtp(phone, otp, pinId);

    if (!verified) {
      throw new UnauthorizedException('Invalid OTP');
    }

    const supabase = this.supabaseService.getClient();

    // Check if user exists
    const { data: existingUsers } = await supabase
      .from('profiles')
      .select('id')
      .eq('phone', phone)
      .limit(1);

    let userId: string;
    let isNewUser = false;

    if (existingUsers && existingUsers.length > 0) {
      userId = existingUsers[0].id;

      // Sign in existing user — generate a session
      const { data: signInData, error: signInError } =
        await supabase.auth.admin.generateLink({
          type: 'magiclink',
          email: `${phone.replace('+', '')}@phone.dineroot.com`,
        });

      if (signInError) {
        this.logger.error('Failed to generate auth link', signInError);
        throw new BadRequestException('Authentication failed');
      }
    } else {
      // Create new user
      const placeholderEmail = `${phone.replace('+', '')}@phone.dineroot.com`;

      const { data: newUser, error: createError } =
        await supabase.auth.admin.createUser({
          phone,
          email: placeholderEmail,
          email_confirm: true,
          phone_confirm: true,
          user_metadata: { phone },
        });

      if (createError) {
        // User might exist with this email already
        if (createError.message?.includes('already been registered')) {
          const { data: existingUser } =
            await supabase.auth.admin.listUsers({ perPage: 1 });
          const found = existingUser?.users?.find(
            (u: { phone?: string; email?: string; id: string }) =>
              u.phone === phone || u.email === placeholderEmail,
          );
          if (found) {
            userId = found.id;
          } else {
            throw new BadRequestException('Failed to create account');
          }
        } else {
          this.logger.error('Failed to create user', createError);
          throw new BadRequestException('Failed to create account');
        }
      } else {
        userId = newUser.user.id;
        isNewUser = true;
      }
    }

    // Update last login
    await supabase
      .from('profiles')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', userId!);

    return {
      message: 'OTP verified successfully',
      user_id: userId!,
      is_new_user: isNewUser,
    };
  }

  async refreshToken(refreshToken: string) {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase.auth.refreshSession({
      refresh_token: refreshToken,
    });

    if (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    return {
      access_token: data.session?.access_token,
      refresh_token: data.session?.refresh_token,
      expires_in: data.session?.expires_in,
    };
  }

  async logout(accessToken: string) {
    const supabase = this.supabaseService.getClient();
    await supabase.auth.admin.signOut(accessToken);
    return { message: 'Logged out successfully' };
  }

  async getProfile(userId: string) {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error || !data) {
      throw new BadRequestException('Profile not found');
    }

    return data;
  }
}
