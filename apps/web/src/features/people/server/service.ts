import "server-only";
import { randomBytes } from "node:crypto";
import { AppError } from "@tracklane/core";
import { db } from "@tracklane/db";
import sharp from "sharp";
import { storage } from "@/server/storage";
import { AVATAR_MAX_BYTES, AVATAR_TYPES, type ProfileData } from "../model";

/** `data` is already validated by `profileSchema` (blank fields are null). */
export async function updateProfile(userId: string, data: ProfileData) {
  await db.user.update({
    where: { id: userId },
    data: {
      name: data.name,
      jobTitle: data.jobTitle,
      department: data.department,
      location: data.location,
      timezone: data.timezone,
      bio: data.bio,
    },
  });
}

export function avatarUrl(userId: string, key: string) {
  // The key changes on every upload, so it doubles as a cache buster.
  return `/api/avatars/${userId}?v=${key.slice(-8)}`;
}

/** Stores a new profile photo as a 256×256 WebP and points `image` at it. */
export async function setAvatar(userId: string, file: { type: string; bytes: Uint8Array }) {
  if (!AVATAR_TYPES.includes(file.type)) {
    throw new AppError("validation_failed", "Use a PNG, JPEG, WebP or GIF image");
  }
  if (file.bytes.byteLength > AVATAR_MAX_BYTES) {
    throw new AppError("validation_failed", "Images can be up to 5 MB");
  }
  let webp: Buffer;
  try {
    // Re-encoding drops metadata (EXIF location etc.) and anything that isn't an image.
    webp = await sharp(file.bytes, { animated: false, limitInputPixels: 40_000_000 })
      .rotate()
      .resize(256, 256, { fit: "cover" })
      .webp({ quality: 85 })
      .toBuffer();
  } catch {
    throw new AppError("validation_failed", "That file isn't an image we can read");
  }
  const key = `avatars/${userId}/${randomBytes(8).toString("hex")}.webp`;
  await storage().put(key, webp);
  const previous = await db.user.findUnique({ where: { id: userId }, select: { avatarKey: true } });
  await db.user.update({
    where: { id: userId },
    data: { avatarKey: key, image: avatarUrl(userId, key) },
  });
  if (previous?.avatarKey) await storage().delete(previous.avatarKey);
  return { image: avatarUrl(userId, key) };
}

export async function removeAvatar(userId: string) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { avatarKey: true } });
  await db.user.update({ where: { id: userId }, data: { avatarKey: null, image: null } });
  if (user?.avatarKey) await storage().delete(user.avatarKey);
}

export async function getAvatarKey(userId: string) {
  return (await db.user.findUnique({ where: { id: userId }, select: { avatarKey: true } }))
    ?.avatarKey;
}
