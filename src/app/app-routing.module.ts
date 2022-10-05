import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthGuard } from './guards/auth.guard';

const routes: Routes = [
  {
    path: 'join',
    loadChildren: () => import('./modules/join/join.module').then(x => x.JoinModule)
  },
  {
    path: '',
    loadChildren: () => import('./modules/chat/chat.module').then(x => x.ChatModule),
    canActivate: [AuthGuard]
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
