import Firestore from '@google-cloud/firestore'

// @ts-ignore
const db = new Firestore({
  projectId: 'timetable-kosimst',
  keyFilename: './credentials/client-auth.json',
})

export default db
