import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'SANDEAL — Mua sắm, nhận lại niềm vui',description:'Tạo link mua sắm Shopee, theo dõi tiền hoàn và yêu cầu rút tiền trong một nơi.',icons:{icon:'/favicon.svg'}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="vi"><body>{children}</body></html>}
