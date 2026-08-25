import { Injectable } from '@nestjs/common';

/**
 * In-memory token revocation store.
 *
 * Tracks the earliest "issued-at" second that is still considered valid for
 * each user. When a user logs out (or changes their password), any token
 * issued *before* that moment is rejected by the JWT strategy.
 *
 * Trade-offs:
 *  - Memory-only: the map clears on restart, but tokens will still expire
 *    naturally within JWT_EXPIRES_IN.  Remaining lifetime after a restart is
 *    the worst-case window, which is acceptable for a single-instance
 *    deployment.  Replace with Redis for multi-instance production use.
 *  - O(1) lookup per request — no database round-trip beyond what
 *    validateUser() already does.
 */
@Injectable()
export class TokenBlacklistService {
  /** userId -> earliest valid iat (Unix seconds) */
  private readonly validFrom = new Map<string, number>();

  /**
   * Invalidate all tokens for a user that were issued before *now*.
   * Call this on logout and on password change.
   */
  invalidateUser(userId: string): void {
    this.validFrom.set(userId, Math.floor(Date.now() / 1000));
  }

  /**
   * Returns true when the token should be rejected.
   * @param userId  Subject claim from the JWT payload.
   * @param iat     Issued-at claim (seconds since epoch) from the JWT payload.
   */
  isRevoked(userId: string, iat: number): boolean {
    const threshold = this.validFrom.get(userId);
    return threshold !== undefined && iat < threshold;
  }
}
