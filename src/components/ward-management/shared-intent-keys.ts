/**
 * M58: one key per break-glass opening or cover intent, kept until the server answers for certain.
 * The same intent (a double tap, or trying again after no answer) reuses its key, so the server
 * applies it once. A clear answer ends the intent; no answer, a server failure or a second
 * sign-in step keeps its key for the retry.
 */
export class SharedIntentKeys {
  private keys = new Map<string, string>();

  key(intent: string, mint: () => string): string {
    let key = this.keys.get(intent);
    if (!key) {
      key = mint();
      if (this.keys.size >= 50) this.keys.clear();
      this.keys.set(intent, key);
    }
    return key;
  }

  /** Sends `body` with the key for this intent (`parts` plus the body) and settles it from the answer. */
  async send<T extends { response: Response; value: { code?: unknown } | null | undefined }>(
    parts: readonly unknown[],
    body: Record<string, unknown>,
    mint: (() => string) | undefined,
    request: (body: Record<string, unknown>) => Promise<T>,
  ): Promise<T> {
    const intent = JSON.stringify([...parts, body]);
    const answer = await request({ ...body, intentKey: this.key(intent, mint ?? (() => crypto.randomUUID())) });
    this.settle(intent, answer.response, answer.value);
    return answer;
  }

  settle(intent: string, response: Response, value: { code?: unknown } | null | undefined): void {
    if (response.status < 500 && !(response.status === 401 && value?.code === "step-up")) this.keys.delete(intent);
  }
}
