import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

@Injectable()
export class HttpService {

    constructor(private http: HttpClient) { }

    get(url: string) {
        return this.http.get(`${environment.baseUrl}/${url}`, { headers: this.getCommonHeader() });
    }

    post(url: string, body: any) {
        return this.http.post(`${environment.baseUrl}/${url}`, body, { headers: this.getCommonHeader() });
    }

    put(url: string, body: any) {
        return this.http.put(`${environment.baseUrl}/${url}`, body, { headers: this.getCommonHeader() });
    }

    delete(url: string) {
        return this.http.delete(`${environment.baseUrl}/${url}`, { headers: this.getCommonHeader() });
    }

    public getCommonHeader() {
        const headers: any = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Origin, Content-Type, X-XSRF-TOKEN'
        };
        return headers;
    }

}