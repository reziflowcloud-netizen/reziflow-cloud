// Offline Job Object fixture only: no HTTP, database, provider or credentials.
import {spawn} from 'node:child_process'
import {fileURLToPath} from 'node:url'
if(process.argv[2]!=='--descendant')spawn(process.execPath,[fileURLToPath(import.meta.url),'--descendant'],{stdio:'ignore',windowsHide:true,env:{SystemRoot:'C:\\Windows',WINDIR:'C:\\Windows'}})
setInterval(()=>{},1000)
