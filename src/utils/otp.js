function generateCode() {
  if (process.env.OTP_DEV_MODE === 'true') return '0000';
  return String(Math.floor(1000 + Math.random() * 9000));
}

async function sendSms(phone, code) {
  if (process.env.OTP_DEV_MODE === 'true') {
    console.log(`[otp:dev] OTP for ${phone} is ${code}`);
    return true;
  }

  if (!process.env.MSG91_AUTH_KEY || !process.env.MSG91_TEMPLATE_ID) {
    console.log(`[otp] (MSG91 not configured) OTP for ${phone} is ${code}`);
    return true;
  }

  // MSG91 OTP API — https://docs.msg91.com/p/tf9GTextN/e/6RiogFWjHK/MSG91
  try {
    const params = new URLSearchParams({
      template_id: process.env.MSG91_TEMPLATE_ID,
      mobile: phone.replace(/^\+?91/, '91'), // MSG91 expects country code without '+'
      authkey: process.env.MSG91_AUTH_KEY,
      otp: code
    });
    const res = await fetch(`https://control.msg91.com/api/v5/otp?${params.toString()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await res.json();
    if (data.type !== 'success') {
      console.error('[otp] MSG91 send failed:', data);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[otp] MSG91 request error:', err.message);
    return false;
  }
}

module.exports = { generateCode, sendSms };
