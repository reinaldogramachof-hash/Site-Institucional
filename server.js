const http=require('http');
const fs=require('fs');
const path=require('path');
const mime={
  '.html':'text/html; charset=utf-8',
  '.css':'text/css',
  '.js':'application/javascript',
  '.json':'application/json',
  '.png':'image/png',
  '.jpg':'image/jpeg',
  '.jpeg':'image/jpeg',
  '.webp':'image/webp',
  '.svg':'image/svg+xml',
  '.ico':'image/x-icon',
  '.woff':'font/woff',
  '.woff2':'font/woff2'
};
const root=__dirname;
const server=http.createServer((req,res)=>{
  let url=req.url.split('?')[0];
  url=decodeURIComponent(url);
  if(url==='/'||url==='') url='/index.html';
  const filePath=path.join(root,url);
  fs.stat(filePath,(err,stat)=>{
    if(err||!stat.isFile()){
      res.statusCode=404;
      res.end('Not Found');
      return;
    }
    const ext=path.extname(filePath).toLowerCase();
    res.setHeader('Content-Type', mime[ext]||'application/octet-stream');
    fs.createReadStream(filePath).pipe(res);
  });
});
const port = Number(process.env.PORT || 5173);
server.listen(port,()=>{
  console.log('http://localhost:'+port+'/');
});