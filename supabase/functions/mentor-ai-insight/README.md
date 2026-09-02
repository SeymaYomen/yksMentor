# AI Mentor Insight Edge Function

Bu fonksiyon yalnız mentor tarafından açıkça tetiklendiğinde çalışır. İstemciden yalnız `studentId` alır; oturumu, teacher rolünü ve mentor–öğrenci ilişkisini sunucuda doğrular. Akademik context mevcut domain motorlarıyla sunucuda oluşturulur.

OpenAI anahtarını kök `.env` dosyasına veya herhangi bir `VITE_*` değişkenine eklemeyin. Secret'ları Supabase Function ortamına tanımlayın:

```sh
supabase secrets set OPENAI_API_KEY=... OPENAI_MODEL=...
supabase functions deploy mentor-ai-insight
```

`OPENAI_MODEL`, hesabınızda Responses API ve Structured Outputs destekleyen bir model kimliği olmalıdır.
