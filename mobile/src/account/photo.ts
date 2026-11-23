import * as ImagePicker from "expo-image-picker";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";

const SIZE = 256;

/**
 * Lets the person choose a photo and turns it into the small square JPEG the
 * website stores (256×256, under 200 KB). Null when nothing was chosen.
 */
export async function pickAvatar(): Promise<string | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
  });
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  // Cut the middle square in case the picker did not crop (the browser version).
  const side = Math.min(asset.width, asset.height);
  const actions = [];
  if (side > 0 && asset.width !== asset.height) {
    actions.push({
      crop: { originX: Math.round((asset.width - side) / 2), originY: Math.round((asset.height - side) / 2), width: side, height: side },
    });
  }
  actions.push({ resize: { width: SIZE, height: SIZE } });
  const out = await manipulateAsync(asset.uri, actions, { compress: 0.82, format: SaveFormat.JPEG, base64: true });
  if (!out.base64) throw new Error("Не удалось прочитать фото — попробуйте другое");
  return `data:image/jpeg;base64,${out.base64}`;
}
