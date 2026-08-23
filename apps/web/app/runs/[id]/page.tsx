import {RunDetail} from "@/components/feature-pages";export default async function Page({params}:{params:Promise<{id:string}>}){return <RunDetail id={(await params).id}/>}
