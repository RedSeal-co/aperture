#!/usr/bin/env node

var EventEmitter = require('events').EventEmitter
var config       = require('./commands/config')
var resolve      = require('path').resolve
var optimist     = require('optimist')
var chalk        = require('chalk')
var fs           = require('fs')
var commands     = {}

var argv = optimist
  .describe('b', 'Exit early on reaching an error during "aperture bulk".')
  .alias('b', 'bail')
  .boolean('b')

  .describe('v', 'Output the current version and exit')
  .alias('v', 'version')
  .boolean('v')

  .describe('d', 'Target a different directory for this command. Default: current directory')
  .alias('d', 'cwd')

  .wrap(65)
  .argv

var cwd = resolve(argv.cwd || process.cwd())
defineCommands()

var command = argv._.shift()
if (argv.version) command = 'version'
if (!command) return help()
if (!commands[command]) return help()

config(cwd, function(err, config) {
  if (err) throw err

  var events = new EventEmitter

  commands[command](cwd
    , config
    , events
    , function(err) {
      if (err) throw err
    })
})

function help() {
  var usage = fs.readFileSync(
    __dirname + '/usage.txt', 'utf8'
  ).trim()

  optimist
    .usage(usage)
    .showHelp()
}

function defineCommands() {
  commands.ln =
  commands.link = function(root, config, events, done) {
    // require commands directly to shave startup time.
    require('./commands/link')(
        root
      , config
      , events.on('link', log)
      , done
    )

    function log(src) {
      console.log(src)
    }
  }

  commands.dedupe =
  commands.purge = function(root, config, events, done) {
    require('./commands/purge')(
        root
      , config
      , events.on('queued', console.log)
      , done
    )
  }

  commands.isntall =
  commands.install = function(root, config, events, done) {
    console.log('checking package versions...')
    require('./commands/install')(
        root
      , config
      , events.on('info progress', function(p) {
        process.stdout.write(((p * 100)|0) + '%    \r')
      }).on('spawn', function(cwd, cmd, args) {
        console.log(chalk.magenta('spawning'), cmd, args, chalk.grey(cwd))
      })
      , done
    )
  }

  commands.each =
  commands.bulk = function(root, config, events, done) {
    config.bail = 'bail' in argv
      ? argv.bail
      : config.bail

    config.bulk = {
        command: argv._[0]
      , args: argv._.slice(1)
    }

    if (!config.bulk.command) return done(new Error(
      'You must supply bulk command with a ' +
      'command object.'
    ))

    require('./commands/bulk')(
        root
      , config
      , events
      , function(err, info) {
        if (err) throw err
        if (info.failed.length) process.exit(1)
      }
    )
  }

  commands.init =
  commands.open = function(root, config, events, done) {
    var prefix = chalk.green('aperture')

    events.on('link', function(mod) {
      console.log(prefix, chalk.magenta('linking module'), mod)
    })

    events.on('queued', function(mod) {
      console.log(prefix, chalk.magenta('removing duplicate'), mod)
    })

    events.on('spawn', function(cwd, cmd, args) {
      console.log(prefix, chalk.magenta('spawning'), cmd, args, chalk.grey(cwd))
    })

    events.once('info progress', function(p) {
      console.log(chalk.magenta('checking registry'))
    }).on('info progress', function(p) {
      process.stdout.write(chalk.green('progress: '))
      process.stdout.write(String((p * 100)|0))
      process.stdout.write('%      \r')
    })

    require('./commands/open')(
        root
      , config
      , events
      , done
    )
  }

  commands.version = function() {
    console.log(require('./package.json').version)
  }

  commands.ls =
  commands.list = function(root, config, events, done) {
    require('./commands/list')(
        root
      , config
      , function(err, modules) {
        if (err) throw err

        modules = modules.map(function(mod) {
          return mod.directory
        })

        console.log(modules.join('\n'))
      }
    )
  }

  commands.config = function(root, config, events, done) {
    console.log(JSON.stringify(config, null, 2))
  }

  commands.expand = function(root, config, events, done) {
    require('./commands/expand')(
        root
      , config
      , events
      , done
    )
  }
}
