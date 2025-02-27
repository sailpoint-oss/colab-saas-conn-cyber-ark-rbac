import { Attributes } from "@sailpoint/connector-sdk";
import { Permission } from "@sailpoint/connector-sdk";

export class Group {
    identity: string
    uuid: string
    type: string = 'group'
    attributes: Attributes
    permissions: Permission[]

    constructor(object: any) {
        this.attributes = {
            id: object.id?.toString(),
            displayName: object.displayName,
            description: object.description
        }
        this.identity = this.attributes.id as string
        this.uuid = this.attributes.displayName as string
        this.permissions = object.permissions
    }
}