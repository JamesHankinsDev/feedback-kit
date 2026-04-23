export {
  submitFeedback,
  checkRateLimit,
  validateFeedbackPayload,
} from "./handler";

export type {
  FeedbackKind,
  FeedbackPayload,
  FeedbackPayloadUser,
  FeedbackContext,
  FeedbackConfig,
  FeedbackResult,
  FeedbackSuccess,
  FeedbackError,
  RateLimitResult,
} from "./handler";

export { POST, createPOST } from "./route";
