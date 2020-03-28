import pkg from './package.json';
import babel from 'rollup-plugin-babel';
import nodeBuiltins from 'rollup-plugin-node-builtins';
import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import builtins from 'builtin-modules';

export default [
  // build client
  {
    input: 'src/client.js',
    output: [
      {
        file: 'docs/client.js',
        format: 'iife',
        sourcemap: 'inline',
        name: 'app',
      },
    ],
    plugins: [
      commonjs(),
      babel(),
      resolve(),
      nodeBuiltins(),
    ],
    watch: {
      clearScreen: false
    },
  },

  // build server
  {
    input: 'src/server.js',
    output: [
      { file: 'dist/server.js', format: 'cjs', sourcemap: 'inline' },
    ],
    external: Object.keys(pkg.dependencies).concat([
      ...builtins,
      'source-map-support/register',
    ]),
    plugins: [
      babel({
        exclude: 'node_modules/**'
      })
    ],
    watch: {
      clearScreen: false
    },
  },
];
