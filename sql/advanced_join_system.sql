-- 1. profiles tablosuna yeni kolon ekleyelim
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS join_code_created_at timestamptz DEFAULT now();

-- 2. Öğretmenin kodunu yenilemesi için RPC fonksiyonu
CREATE OR REPLACE FUNCTION public.refresh_join_code()
RETURNS text AS $$
DECLARE
  v_new_code text;
BEGIN
  -- Sadece öğretmen rolündekiler kod yenileyebilir
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'teacher') THEN
    RAISE EXCEPTION 'Bu işlem için öğretmen yetkisi gereklidir.';
  END IF;

  -- Yeni 8 haneli rastgele kod üret
  v_new_code := substring(md5(gen_random_uuid()::text) from 1 for 8);

  -- Profili güncelle
  UPDATE public.profiles
  SET join_code = v_new_code,
      join_code_created_at = now()
  WHERE id = auth.uid();

  RETURN v_new_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Sadece giriş yapmış kullanıcılar çağırabilir
GRANT EXECUTE ON FUNCTION public.refresh_join_code() TO authenticated;

-- 3. Öğrencinin öğretmeni koda göre güvenle sorgulayabilmesi için RPC fonksiyonu
-- RLS kurallarını delmeden (SECURITY DEFINER) çalışır, sadece eşleşme varsa isim döner.
CREATE OR REPLACE FUNCTION public.get_teacher_info_by_code(p_code text)
RETURNS json AS $$
DECLARE
  v_teacher record;
BEGIN
  SELECT id, username, role 
  INTO v_teacher 
  FROM public.profiles 
  WHERE join_code = p_code AND role = 'teacher' 
  LIMIT 1;

  IF v_teacher IS NULL THEN
    RETURN NULL;
  END IF;

  -- Sadece gerekli (hassas olmayan) bilgileri json formatında dönüyoruz
  RETURN json_build_object(
    'id', v_teacher.id,
    'username', v_teacher.username
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Sadece giriş yapmış öğrenciler çağırabilir
GRANT EXECUTE ON FUNCTION public.get_teacher_info_by_code(text) TO authenticated;
