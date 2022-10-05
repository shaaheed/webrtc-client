import { Injectable } from "@angular/core";
import { ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree, Router, CanActivate, CanActivateChild } from '@angular/router';
import { Observable } from 'rxjs';

@Injectable()
export class AuthGuard implements CanActivate, CanActivateChild {

    constructor(private router: Router) { }

    canActivate(
        route: ActivatedRouteSnapshot,
        state: RouterStateSnapshot): boolean | UrlTree | Observable<boolean | UrlTree> | Promise<boolean | UrlTree> {
        return this.check(route);
    }

    canActivateChild(childRoute: ActivatedRouteSnapshot, state: RouterStateSnapshot): Observable<boolean | UrlTree> | Promise<boolean | UrlTree> | boolean | UrlTree {
        return this.check(childRoute);
    }

    private check(route: ActivatedRouteSnapshot): boolean | Observable<boolean> {
        // return true;
        const socketId = sessionStorage.getItem('socket_id');
        const username = sessionStorage.getItem('username');
        if (!(socketId && username)) {
            this.router.navigateByUrl('/join');
            return false;
        }
        return true;
    }

}