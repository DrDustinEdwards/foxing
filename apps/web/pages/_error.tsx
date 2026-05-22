import type { NextPageContext } from 'next'

type Props = { statusCode: number | null }

export default function Error({ statusCode }: Props) {
  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>{statusCode ? `${statusCode}` : 'Error'}</h1>
      <p>{statusCode === 404 ? 'Page not found.' : 'An error occurred.'}</p>
    </div>
  )
}

Error.getInitialProps = ({ res, err }: NextPageContext) => {
  const statusCode = res ? res.statusCode : err ? err.statusCode ?? null : null
  return { statusCode }
}
