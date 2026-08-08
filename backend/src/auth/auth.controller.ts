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
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @ApiOperation({ summary: 'Créer un compte client' })
  @ApiResponse({ status: 201, description: 'Compte créé.' })
  @ApiResponse({ status: 409, description: 'Email déjà utilisé.' })
  @ApiResponse({ status: 429, description: 'Trop de tentatives.' })
  // argon2.hash est volontairement lent : sans plafond, une rafale
  // d'inscriptions suffirait à saturer le CPU du serveur.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @ApiOperation({ summary: 'Se connecter (access + refresh tokens)' })
  @ApiResponse({ status: 200, description: 'Connexion réussie.' })
  @ApiResponse({ status: 401, description: 'Identifiants incorrects.' })
  @ApiResponse({ status: 429, description: 'Trop de tentatives.' })
  // Protection contre le test massif de mots de passe.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
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
    return this.authService.me(req.user.id);
  }

  // ── Confirmation de l'adresse email ──
  // Ces deux routes sont authentifiées : l'inscription connecte immédiatement,
  // la cliente a donc déjà ses tokens quand elle saisit son code. Le compte
  // visé vient du JWT et non du corps de la requête — personne ne peut donc
  // faire confirmer, ni faire renvoyer un code, sur l'adresse d'un tiers.

  @ApiOperation({ summary: "Confirmer son adresse email avec le code reçu" })
  @ApiResponse({ status: 200, description: 'Adresse confirmée.' })
  @ApiResponse({ status: 400, description: 'Code invalide ou expiré.' })
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  // Le plafond de 5 essais par code empêche déjà de le deviner ; cette limite
  // ferme la voie de contournement consistant à redemander un code sans fin.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  verifyEmail(@Req() req: any, @Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(req.user.id, dto.code);
  }

  @ApiOperation({ summary: 'Recevoir un nouveau code de confirmation' })
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('resend-code')
  @HttpCode(HttpStatus.OK)
  resendCode(@Req() req: any) {
    return this.authService.resendVerificationCode(req.user.id);
  }

  // ── Mot de passe oublié ──
  // Routes publiques par nature : la cliente ne peut pas se connecter. Les deux
  // répondent donc à l'identique, que le compte existe ou non.

  @ApiOperation({ summary: 'Demander un code de réinitialisation' })
  @ApiResponse({
    status: 200,
    description: 'Réponse identique que le compte existe ou non.',
  })
  // Chaque appel déclenche un envoi d'email : sans plafond, cette route sert à
  // inonder la boîte d'une cliente, et à consommer notre quota d'envoi.
  @Throttle({ default: { limit: 5, ttl: 300_000 } })
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @ApiOperation({ summary: 'Choisir un nouveau mot de passe avec le code reçu' })
  @ApiResponse({ status: 400, description: 'Code invalide ou expiré.' })
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
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