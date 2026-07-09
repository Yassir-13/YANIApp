import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @ApiOperation({ summary: 'Créer un compte client' })
  @ApiResponse({ status: 201, description: 'Compte créé.' })
  @ApiResponse({ status: 409, description: 'Email déjà utilisé.' })
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @ApiOperation({ summary: 'Se connecter (access + refresh tokens)' })
  @ApiResponse({ status: 200, description: 'Connexion réussie.' })
  @ApiResponse({ status: 401, description: 'Identifiants incorrects.' })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @ApiOperation({ summary: "Profil de l'utilisateur connecté" })
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @Get('me')
  getMe(@Req() req: any) {
    return req.user;
  }

  @ApiOperation({ summary: "Renouveler l'access token (rotation)" })
  @ApiResponse({ status: 403, description: 'Token réutilisé — session révoquée.' })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @ApiOperation({ summary: 'Se déconnecter (révoque la session)' })
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Body() dto: RefreshDto) {
    return this.authService.logout(dto.refreshToken);
  }
}