import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { NzLayoutModule } from 'ng-zorro-antd/layout';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { NzSpaceModule } from 'ng-zorro-antd/space';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterLink, NzLayoutModule, NzButtonModule, NzIconModule, NzAvatarModule, NzSpaceModule],
  templateUrl: './header.html',
  styleUrls: ['./header.css']
})
export class HeaderComponent {}
