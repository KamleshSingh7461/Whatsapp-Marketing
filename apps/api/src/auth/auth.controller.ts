import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { CreateInviteDto } from './dto/invite.dto';
import { RegisterInviteDto } from './dto/register-invite.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getMe(@Req() req: any) {
    return this.authService.getMe(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('invite')
  createInvite(@Req() req: any, @Body() dto: CreateInviteDto) {
    return this.authService.createInvite(req.user.userId, dto.email, dto.role);
  }

  @Get('invite/:token')
  validateInvite(@Param('token') token: string) {
    return this.authService.validateInvite(token);
  }

  @Post('register-invite')
  registerInvite(@Body() dto: RegisterInviteDto) {
    return this.authService.acceptInvite(dto.token, dto.name, dto.password);
  }

  @UseGuards(JwtAuthGuard)
  @Get('team')
  getTeamMembers() {
    return this.authService.getTeamMembers();
  }

  @UseGuards(JwtAuthGuard)
  @Delete('team/:id')
  deleteTeamMember(@Req() req: any, @Param('id') id: string) {
    return this.authService.deleteTeamMember(id, req.user.userId);
  }
}
