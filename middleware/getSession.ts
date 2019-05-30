import fetch from 'node-fetch'

export const getSession = async () => {
  const auth = await fetch(
    'https://thalia.webuntis.com/WebUntis/?school=ahs-korneuburg',
  )

  const cookiesAll = auth.headers.get('set-cookie')
  const cookiesFiltered =
    cookiesAll &&
    cookiesAll
      .split('; ')
      .filter(
        cookie =>
          cookie.includes('JSESSIONID') || cookie.includes('schoolname'),
      )
      .map(cookie => cookie.replace('HttpOnly, ', ''))
      .join('; ')

  return cookiesFiltered
}