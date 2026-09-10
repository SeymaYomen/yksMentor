export function authMessage(error: unknown): string {
  const value = error as { code?: string; message?: string; status?: number } | null
  switch (value?.code) {
    case 'email_not_confirmed': return 'E-posta adresiniz henüz doğrulanmadı. Gelen kutunuzdaki onay bağlantısını açıp tekrar giriş yapın.'
    case 'invalid_credentials': return 'E-posta veya şifre hatalı. Bilgilerinizi kontrol edin; hesabınız yoksa kayıt oluşturun.'
    case 'user_not_found': return 'Bu bilgilerle giriş yapılamadı. E-posta adresinizi kontrol edin veya kayıt oluşturun.'
    case 'weak_password': return 'Daha güçlü bir şifre seçin. Şifreniz en az 6 karakter olmalıdır.'
    case 'user_already_exists': case 'email_exists': return 'Bu e-posta ile kayıt tamamlanamadı. Mevcut hesabınızla giriş yapmayı deneyin.'
    case 'over_request_rate_limit': case 'over_email_send_rate_limit': return 'Çok fazla deneme yapıldı. Biraz bekleyip tekrar deneyin.'
    case 'signup_disabled': return 'Yeni hesap kaydı şu anda kapalı. Daha sonra tekrar deneyin.'
    case 'validation_failed': case 'email_address_invalid': return 'Geçerli bir e-posta adresi girin.'
  }
  if (value?.message?.includes('profili bulunamadı')) return 'Hesabınıza ait profil henüz hazır değil. Tekrar deneyin; sorun sürerse destek isteyin.'
  if (/yapılandırılmamış|invalid api key/i.test(value?.message ?? '')) return 'Giriş hizmetinin bağlantı ayarları hazır değil. Lütfen uygulama yöneticisine bildirin.'
  if (/fetch|network/i.test(value?.message ?? '')) return 'Bağlantı kurulamadı. İnternet bağlantınızı kontrol edip tekrar deneyin.'
  return 'İşlem tamamlanamadı. Lütfen tekrar deneyin; sorun sürerse destek isteyin.'
}
