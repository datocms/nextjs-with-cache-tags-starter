import React from 'react'
import { } from "next/navigation"

import { executeQuery } from '@/lib/fetch-contents';

const QUERY = `
  {
    meta: _allPostsMeta{
      count
    }
  }
`;

type Props = {}

async function Header({}: Props) {
  const { data, tags } = await executeQuery(QUERY);

  const { meta } = data;
  const { count } = meta;
  
  return (
    <header>
      <p><a href="/">Go home</a> · {count} posts</p>
    </header>
  )
}

export default Header