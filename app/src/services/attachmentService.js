import { Linking } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { tryFetchApi } from './apiClient';

const MAX_BYTES = 5 * 1024 * 1024; // the server accepts files up to 5 MB

// file:// or blob: uri -> base64 text (fetch + FileReader work on iOS, Android and web)
const readAsBase64 = async (uri) => {
  const blob = await (await fetch(uri)).blob();
  if (blob.size > MAX_BYTES) throw new Error('ไฟล์ใหญ่เกิน 5 MB กรุณาเลือกไฟล์ที่เล็กลง');
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = String(reader.result || '');
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.onerror = () => reject(new Error('อ่านไฟล์ไม่สำเร็จ'));
    reader.readAsDataURL(blob);
  });
};

const imageOptions = { mediaTypes: ['images'], quality: 0.8 };

/**
 * Let the employee choose a file: take a photo, pick a photo from the gallery, or pick a document (PDF / Word / image).
 * Resolves { uri, name, mimeType, isImage } or null when the employee cancels. Throws if permission is refused.
 */
export async function pickAttachment(source) {
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new Error('กรุณาอนุญาตการใช้กล้องในตั้งค่าของเครื่อง');
    const r = await ImagePicker.launchCameraAsync(imageOptions);
    if (r.canceled || !r.assets || !r.assets[0]) return null;
    const a = r.assets[0];
    return { uri: a.uri, name: a.fileName || `photo_${Date.now()}.jpg`, mimeType: a.mimeType || 'image/jpeg', isImage: true };
  }
  if (source === 'library') {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) throw new Error('กรุณาอนุญาตการเข้าถึงรูปภาพในตั้งค่าของเครื่อง');
    const r = await ImagePicker.launchImageLibraryAsync(imageOptions);
    if (r.canceled || !r.assets || !r.assets[0]) return null;
    const a = r.assets[0];
    return { uri: a.uri, name: a.fileName || `image_${Date.now()}.jpg`, mimeType: a.mimeType || 'image/jpeg', isImage: true };
  }
  const r = await DocumentPicker.getDocumentAsync({
    type: ['application/pdf', 'image/*', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    copyToCacheDirectory: true,
  });
  if (r.canceled || !r.assets || !r.assets[0]) return null;
  const a = r.assets[0];
  return { uri: a.uri, name: a.name, mimeType: a.mimeType || 'application/octet-stream', isImage: String(a.mimeType || '').startsWith('image/') };
}

/**
 * Upload the chosen file to the server first (photos are shrunk to JPEG so they stay small).
 * Resolves { id, url, fileName } — url is what goes into the leave request as attachmentUrl.
 */
export async function uploadLeaveAttachment(file) {
  let { uri, name, mimeType } = file;
  // HEIC and other phone formats are not accepted by the server: re-encode every photo as JPEG
  if (file.isImage) {
    const small = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: 1600 } }], {
      compress: 0.7,
      format: ImageManipulator.SaveFormat.JPEG,
    });
    uri = small.uri;
    mimeType = 'image/jpeg';
    name = String(name || 'photo').replace(/\.[A-Za-z0-9]+$/, '') + '.jpg';
  }

  const dataBase64 = await readAsBase64(uri);
  const res = await tryFetchApi('/uploads/leave-attachment', {
    method: 'POST',
    body: JSON.stringify({ fileName: name, mimeType, dataBase64 }),
    timeoutMs: 60000,
  });
  if (!res) throw new Error('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ ไฟล์ยังไม่ถูกอัปโหลด กรุณาลองใหม่อีกครั้ง');
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) throw new Error(data.message || 'อัปโหลดไฟล์ไม่สำเร็จ');
  return { id: data.attachment.id, url: data.attachment.url, fileName: data.attachment.fileName };
}

/** Open an attachment (stored as "/uploads/leave/<id>") in the phone's browser / viewer using a 5-minute link */
export async function openLeaveAttachment(attachmentUrl) {
  const id = String(attachmentUrl || '').split('/').pop();
  const res = await tryFetchApi(`/uploads/leave/${encodeURIComponent(id)}/link`);
  if (!res) throw new Error('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้');
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) throw new Error(data.message || 'ไม่สามารถเปิดไฟล์แนบได้');
  await Linking.openURL(data.url);
}
