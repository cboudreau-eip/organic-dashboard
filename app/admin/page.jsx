import {notFound} from 'next/navigation';
import {requireUser} from '../../lib/auth/server';
import {isOwner} from '../../lib/auth/access';
import UserAdmin from '../../components/admin/UserAdmin';
import './admin.css';
export const dynamic='force-dynamic';
export const metadata={title:'Manage users',robots:{index:false,follow:false}};
export default async function AdminPage(){
 const {user}=await requireUser();
 if(!isOwner(user))notFound();
 return <UserAdmin/>;
}
