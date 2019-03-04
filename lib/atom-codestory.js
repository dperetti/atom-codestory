'use babel';

import path from 'path'
import { CompositeDisposable } from 'atom'
import { spawn } from 'child_process'
import packageConfig from './config-schema.json'
import fs from 'fs'

// this is what a token should look like
const tokenRePattern = '#[a-zA-Z0-9]{5}#'
const re = new RegExp(tokenRePattern, 'g')

const findDocumentationUpInHierarchy = (file) => {
  let folder = file
  let documentationPath = null
  while (documentationPath === null && folder !== '/') {
    folder = path.dirname(folder)
    const files = fs.readdirSync(folder)
    files.some(file => {
      if (file.match(/.+\.codestory$/)) {
        documentationPath = path.join(folder, file)
        return true
      }
    })
  }
  return documentationPath
}

export default {
  config: packageConfig,
  subscriptions: new CompositeDisposable(),
  markers: [],
  activate() {
    this.subscriptions.add(atom.workspace.observeTextEditors(editor => {
      this.subscriptions.add(editor.onDidChange(event => {
        this.highlightTokens(editor) // #9Debv#
      }))
    }))
    this.subscriptions.add(
      atom.workspace.onDidChangeActivePaneItem(() => this.highlightTokens(atom.workspace.getActiveTextEditor())) // #Hqjn6#
    )
  },
  deactivate() {
    this.subscriptions.dispose();
  },
  highlightTokens(editor) { // #khGD4#
    if (!editor) return
    this.markers.forEach(m => m.destroy())
    this.markers = []
    editor.scan(re, (obj) => {
      const marker = editor.markBufferRange(obj.range)
      // https://atom.io/docs/api/v1.10.2/TextEditor#instance-decorateMarker
      const decoration = editor.decorateMarker(marker, { type: 'highlight', class: 'codestory-token' })
      this.markers.push(decoration)
    })
  },
  // https://github.com/facebooknuclide/hyperclick#provider-api
  getProvider() { // #P4S7v#
    return {
      providerName: 'hyperclick-codestory',
      wordRegExp: new RegExp(tokenRePattern),
      getSuggestionForWord(textEditor, text, range) {
        if (!re.exec(text)) return null  // #x8U8m#
        return {
          // The range(s) to underline as a visual cue for clicking.
          range,
          textEditor,
          // The function to call when the underlined text is clicked.
          callback: () => {
            const cmd = atom.config.get('codestory.codeStoryAppPath') // #MsTbt#
            const currentFilePath = path.join(textEditor.getDirectoryPath(), textEditor.getFileName())
            const documentationPath = findDocumentationUpInHierarchy(currentFilePath)

            if (documentationPath) {
              const args = ['-p', documentationPath, '-s', text.slice(1, 6)]

              console.log('args', cmd, args)

              const p = spawn(cmd, args, { detached: true })
              p.stderr.on('data', (data) => {
                atom.notifications.addError('Code Story', { detail: data });
              })
              // p.stdout.on('data', (data) => {
              //   console.log('stdout: ' + data) // eslint-disable-line
              // })
              // p.on('close', (code) => {
              //   console.log('child process exited with code ' + code) // eslint-disable-line
              // })
              p.unref()
            } else {
              atom.notifications.addError('Code Story launch error', { detail: 'No Code Story documentation could be found.' });
            }
          },
        }
      },
    }
  },
}
