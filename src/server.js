// import '@babel/polyfill';
import path from 'path';
import connect from 'connect';
import serveStatic from 'serve-static';
import portfinder from 'portfinder';
import livereload from 'livereload';


const publicDir = path.join(process.cwd(), 'docs');

const lrserver = livereload.createServer();
lrserver.watch(publicDir);

// static file server
portfinder.basePort = 3000;
portfinder.getPortPromise()
  .then(port => {
    connect()
      .use(serveStatic(publicDir))
      .listen(port, () => console.log(`> server running on http://127.0.0.1:${port}`));
  })
  .catch((err) => {
    console.error('no available port');
  });
