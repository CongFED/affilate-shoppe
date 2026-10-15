import {cookies} from 'next/headers';
import {SESSION_COOKIE} from '../lib/auth-core';
import {sessionUser} from '../lib/auth-service';
export async function getAppUser(){const cookieStore=await cookies();return sessionUser(cookieStore.get(SESSION_COOKIE)?.value??'');}
