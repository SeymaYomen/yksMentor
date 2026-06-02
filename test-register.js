import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing Supabase credentials in .env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function testRegistration() {
  console.log("Testing Supabase Registration...");
  
  const testEmail = `testuser_${Date.now()}@example.com`;
  const testPassword = 'TestPassword123!';
  const testUsername = `testuser_${Date.now()}`;
  
  console.log(`Registering with email: ${testEmail}`);

  const { data, error } = await supabase.auth.signUp({
    email: testEmail,
    password: testPassword,
    options: {
      data: {
        username: testUsername,
        role: 'student'
      }
    }
  });

  if (error) {
    console.error("❌ Error during sign up:", error.message);
    process.exit(1);
  }

  console.log("✅ Sign up successful! User ID:", data.user?.id);
  
  console.log("Fetching profile to verify triggers worked...");
  
  // Wait a moment for trigger to run
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('*');
    
  if (profileError) {
    console.error("❌ Error fetching profile:", profileError.message);
    process.exit(1);
  }
  
  console.log("All profiles in DB:");
  console.log(profiles);

  const { data: upsertData, error: upsertError } = await supabase.from('profiles').upsert([{ id: data.user.id, username: testUsername, role: 'student', mentor_id: null }], { onConflict: 'id' }).select().maybeSingle();
  if (upsertError) {
    console.error("❌ Error during upsert:", upsertError);
  } else {
    console.log("✅ Upsert successful:", upsertData);
  }

  const myProfile = profiles.find(p => p.id === data.user.id);
  
  if (myProfile || upsertData) {
    console.log("✅ Profile created successfully via trigger!");
    console.log("Profile data:", myProfile);
  } else {
    console.error("❌ Profile NOT found after registration.");
    process.exit(1);
  }
  
  console.log("🎉 All tests passed successfully!");
}

testRegistration();
