import request from '@/utils/request'
import { WellInfo } from '@/utils/production'

export function getWellList(params: any) {
  return request({
    url: '/well/list',
    method: 'get',
    params
  }).then(res => res.data as WellInfo[])
}

export function getWellDetail(id: number) {
  return request({
    url: `/well/${id}`,
    method: 'get'
  })
}

export function createWell(data: any) {
  return request({
    url: '/well',
    method: 'post',
    data
  })
}

export function updateWell(data: any) {
  return request({
    url: '/well',
    method: 'put',
    data
  })
}

export function deleteWell(id: number) {
  return request({
    url: `/well/${id}`,
    method: 'delete'
  })
}

export function getWellStatistics() {
  return request({
    url: '/well/statistics',
    method: 'get'
  })
}
