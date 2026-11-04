import React from 'react'
import BlockRequestTable from '../BlockRequestTable'

const BlockRequestView = ({currentUser}) => {
  return (
    <div>
        <BlockRequestTable currentUser={currentUser} />
    </div>
  )
}

export default BlockRequestView