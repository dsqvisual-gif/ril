"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { removeAvatar, setAvatar } from "@/lib/actions/avatar";
import { AVATAR_MAX_BYTES, AVATAR_SIZE } from "@/lib/avatar";
import styles from "./AvatarSettings.module.css";

type Props = {
  name: string;
  src: string | null;
  /** Whether the photo was uploaded here (it can be removed) or comes from Google. */
  uploaded: boolean;
};

/** Crops the picture to a centred square and shrinks it to a small JPEG. */
async function squareJpeg(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const canvas = document.createElement("canvas");
    canvas.width = AVATAR_SIZE;
    canvas.height = AVATAR_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas");
    ctx.fillStyle = "#fff"; // transparent PNGs get a white background, not black
    ctx.fillRect(0, 0, AVATAR_SIZE, AVATAR_SIZE);
    ctx.drawImage(
      img,
      (img.naturalWidth - side) / 2,
      (img.naturalHeight - side) / 2,
      side,
      side,
      0,
      0,
      AVATAR_SIZE,
      AVATAR_SIZE,
    );
    for (const quality of [0.86, 0.72, 0.55]) {
      const data = canvas.toDataURL("image/jpeg", quality);
      if (data.length * 0.75 < AVATAR_MAX_BYTES) return data;
    }
    throw new Error("too big");
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function AvatarSettings({ name, src, uploaded }: Props) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [shown, setShown] = useState(src);
  const [own, setOwn] = useState(uploaded);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (!file.type.startsWith("image/")) {
      setError("Выберите картинку: JPG, PNG или фото с телефона");
      return;
    }
    setBusy(true);
    try {
      const data = await squareJpeg(file);
      setShown(data);
      const result = await setAvatar(data);
      if (!result.ok) {
        setShown(src);
        setError(result.error);
        return;
      }
      setShown(result.data);
      setOwn(true);
      router.refresh();
    } catch {
      setShown(src);
      setError("Не удалось открыть это фото — попробуйте другое");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  async function remove() {
    setBusy(true);
    setError(null);
    const result = await removeAvatar();
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setShown(result.data);
    setOwn(false);
    router.refresh();
  }

  return (
    <div className={styles.root}>
      <button
        type="button"
        className={styles.photo}
        onClick={() => input.current?.click()}
        disabled={busy}
        aria-label="Выбрать фото профиля"
      >
        <Avatar src={shown} name={name} size={88} />
        <span className={styles.badge} aria-hidden>
          {busy ? "…" : "📷"}
        </span>
      </button>
      <div className={styles.side}>
        <b className={styles.title}>Фото профиля</b>
        <span className={styles.note}>Его видят друзья и команда.</span>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.primary}
            onClick={() => input.current?.click()}
            disabled={busy}
          >
            {busy ? "Загружаю…" : shown ? "Сменить фото" : "Загрузить фото"}
          </button>
          {own ? (
            <button type="button" className={styles.remove} onClick={() => void remove()} disabled={busy}>
              Удалить
            </button>
          ) : null}
        </div>
        {error ? <p className="form-error">{error}</p> : null}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => void pick(e.target.files?.[0])}
      />
    </div>
  );
}
