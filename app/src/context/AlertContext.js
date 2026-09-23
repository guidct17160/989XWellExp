import React, { createContext, useContext, useState, useEffect } from 'react';
import CustomAlertModal from '../components/CustomAlertModal';
import { registerAlertHandler } from '../utils/alertPolyfill';

const AlertContext = createContext();

export function AlertProvider({ children }) {
  const [alertConfig, setAlertConfig] = useState({
    visible: false,
    title: '',
    message: '',
    type: 'info',
    buttons: [],
  });

  const showAlert = (title, message, type = 'auto', buttons = []) => {
    let alertType = type;
    const t = String(title || '');
    const m = String(message || '');
    const fullText = `${t} ${m}`;

    // Auto-detect if type is auto, default or error
    if (!type || type === 'auto' || type === 'error') {
      const isError =
        fullText.includes('ไม่สำเร็จ') ||
        fullText.includes('ล้มเหลว') ||
        fullText.includes('ผิดพลาด') ||
        fullText.includes('เกิดข้อผิดพลาด') ||
        fullText.includes('ข้อผิดพลาด') ||
        fullText.includes('ไม่ถูกต้อง') ||
        fullText.includes('ไม่ตรงกัน') ||
        fullText.includes('Error') ||
        fullText.includes('Failed') ||
        fullText.includes('Fail');

      const isSuccess =
        fullText.includes('สำเร็จ') ||
        fullText.includes('เรียบร้อย') ||
        fullText.includes('ส่งเควส') ||
        fullText.includes('รับรางวัล') ||
        fullText.includes('ยินดีต้อนรับ') ||
        fullText.includes('บันทึกแล้ว') ||
        fullText.includes('อนุมัติแล้ว') ||
        fullText.includes('คัดลอกแล้ว') ||
        fullText.includes('ดาวน์โหลดแล้ว') ||
        fullText.includes('Success') ||
        fullText.includes('Completed') ||
        fullText.includes('Done') ||
        t.includes('🎉') ||
        t.includes('✅') ||
        t.includes('✨') ||
        t.includes('🎊') ||
        t.includes('🏆') ||
        m.includes('🎉') ||
        m.includes('✅');

      const isWarning =
        fullText.includes('แจ้งเตือน') ||
        fullText.includes('คำเตือน') ||
        fullText.includes('โปรดระวัง') ||
        fullText.includes('ข้อกำหนดความปลอดภัย') ||
        fullText.includes('Warning') ||
        t.includes('⚠️') ||
        t.includes('🔔');

      const isInfo =
        fullText.includes('Face ID') ||
        fullText.includes('ออกจากระบบ') ||
        fullText.includes('Info') ||
        fullText.includes('ข้อมูล') ||
        fullText.includes('หมายเหตุ');

      if (isError) {
        alertType = 'error';
      } else if (isSuccess) {
        alertType = 'success';
      } else if (isWarning) {
        alertType = 'warning';
      } else if (isInfo) {
        alertType = 'info';
      } else {
        alertType = 'info';
      }
    }

    setAlertConfig({
      visible: true,
      title: title || 'แจ้งเตือน',
      message: message || '',
      type: alertType,
      buttons: buttons && buttons.length > 0 ? buttons : [{ text: 'ตกลง', style: 'default' }],
    });
  };

  const hideAlert = () => {
    setAlertConfig((prev) => ({ ...prev, visible: false }));
  };

  useEffect(() => {
    registerAlertHandler((title, message, buttons) => {
      showAlert(title, message, 'auto', buttons);
    });
  }, []);

  return (
    <AlertContext.Provider value={{ showAlert, hideAlert }}>
      {children}
      <CustomAlertModal
        visible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        buttons={alertConfig.buttons}
        onClose={hideAlert}
      />
    </AlertContext.Provider>
  );
}

export const useAlert = () => useContext(AlertContext);
