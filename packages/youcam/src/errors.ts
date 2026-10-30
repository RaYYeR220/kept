export class YouCamHttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string | null,
    message: string,
  ) {
    super(message);
    this.name = "YouCamHttpError";
  }
}

export class YouCamTaskError extends Error {
  readonly retake: string | null;
  constructor(
    readonly code: string,
    readonly taskId: string | null,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "YouCamTaskError";
    this.retake = mapEngineError(code).retake;
  }
}

// One plain sentence per engine error, written for a tired person holding a phone.
const RETAKE: Record<string, string> = {
  error_no_face: "We couldn't find a face. Face the camera with your whole face in view.",
  error_src_face_too_small: "Move a little closer so your face fills most of the frame.",
  error_face_position_too_small: "Move a little closer so your face fills most of the frame.",
  error_src_face_out_of_bound: "Your face is partly out of the frame. Centre it and try again.",
  error_face_position_out_of_boundary: "Your face is partly out of the frame. Centre it and try again.",
  error_face_position_invalid: "Centre your face in the frame and try again.",
  error_lighting_dark: "It's a little dark. Face a window or a lamp and try again.",
  error_insufficient_lighting: "It's a little dark. Face a window or a lamp and try again.",
  error_below_min_image_size: "That photo is too small. Take a new one with the camera.",
  error_exceed_max_image_size: "That photo is too large. Take a new one with the camera.",
  exceed_max_filesize: "That photo is too large. Take a new one with the camera.",
  error_large_face_angle: "Look straight at the camera with your head level.",
  error_face_angle_invalid: "Look straight at the camera with your head level.",
  error_face_not_forward_facing: "Look straight at the camera with your head level.",
  error_face_angle_upward: "Lower your chin a little and look straight ahead.",
  error_face_angle_downward: "Lift your chin a little and look straight ahead.",
  error_face_angle_leftward: "Turn your head slightly to the right, facing the camera.",
  error_face_angle_rightward: "Turn your head slightly to the left, facing the camera.",
  error_face_angle_left_tilt: "Keep your head level, without tilting.",
  error_face_angle_right_tilt: "Keep your head level, without tilting.",
  error_face_pose: "Look straight at the camera with your head level.",
  error_multiple_people: "Only one person should be in the photo.",
  error_multi_person: "Only one person should be in the photo.",
  error_no_shoulder: "Step back a little so your shoulders are in the photo.",
  error_hair_too_short: "This try-on needs a photo with your hair. Use the photo from your likeness.",
  error_bald_image: "This try-on needs a photo with your hair. Use the photo from your likeness.",
  error_src_eye_closed: "Keep your eyes open for the photo.",
  error_src_eye_occluded: "Keep your eyes uncovered — glasses off if you can.",
  error_insufficient_landmarks: "We couldn't read your face clearly. Try again in even light, facing the camera.",
  error_face_parsing: "We couldn't read your face clearly. Try again in even light, facing the camera.",
  error_nsfw_content_detected: "That photo can't be used. Please take a new one.",
};

export function mapEngineError(code: string): { retake: string | null } {
  return { retake: RETAKE[code] ?? null };
}
