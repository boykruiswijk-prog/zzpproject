UPDATE auth.users 
SET encrypted_password = crypt('WelkomBoy!', gen_salt('bf')),
    updated_at = now()
WHERE email = 'boy.kruiswijk@zpzaken.nl';