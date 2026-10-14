import { SafeUser } from '../interfaces/jwt-payload.interface';

export class AuthResponseDto {
  accessToken: string;
  user: SafeUser;
}

export class RefreshResponseDto {
  accessToken: string;
}
