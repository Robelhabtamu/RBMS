export type BoothStatus='ACTIVE'|'INACTIVE'
export type BoothOperationalState='OPEN'|'CLOSED'|'CLOSED_WITH_DISCREPANCY'|'PENDING_REVIEW'|'NOT_STARTED'
export type BoothFilters={locationId:string;status:string;operationalState:string;search:string}
export type BoothRecord={id:string;name:string;code:string;status:BoothStatus;location_id:string;location_name:string;salesperson_id:string|null;salesperson_name:string|null;business_day_id:string|null;operational_state:BoothOperationalState;today_revenue:number;today_prints:number;paper_status:string;closing_status:string|null;started_at:string|null;closed_at:string|null;created_at:string;updated_at:string}
export type BoothSummary={total:number;active:number;operating:number;attention:number}
export type BoothHistory={business_day_id:string;booth_id:string;business_date:string;status:string;salesperson_name:string;revenue:number;prints:number;closing_status:string|null;paper_difference:number|null;revenue_difference:number|null;started_at:string;closed_at:string|null}
export type BoothLocation={id:string;name:string;status:BoothStatus}
export type BoothOptions={locations:BoothLocation[]}
