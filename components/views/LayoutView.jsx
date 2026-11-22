import { getCurrentUser } from "@/lib/auth";
import DashboardLayout from "../DashboardLayout"

export default async ({children}) => {
    const user = await getCurrentUser();
    return (
        <>
            <DashboardLayout>
                {children}
            </DashboardLayout>
        </>
    )
}