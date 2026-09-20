/**
 * Minimal subset of the Telegram Bot API types — only the fields this
 * integration reads. Deliberately not exhaustive: a full transcription would
 * be a maintenance burden with no benefit, since unknown fields are ignored.
 *
 * https://core.telegram.org/bots/api
 */

export type TelegramChat = {
  id: number;
  type: "private" | "group" | "supergroup" | "channel";
  username?: string;
  title?: string;
};

export type TelegramUser = {
  id: number;
  is_bot: boolean;
  first_name: string;
  username?: string;
};

export type TelegramMessage = {
  message_id: number;
  date: number;
  chat: TelegramChat;
  from?: TelegramUser;
  /** Absent for photos, stickers, voice notes and every other non-text message. */
  text?: string;
};

export type TelegramUpdate = {
  update_id: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
};

/** Every Bot API response is this envelope. HTTP status alone is not enough. */
export type TelegramResponse<T> = {
  ok: boolean;
  result?: T;
  error_code?: number;
  description?: string;
};
