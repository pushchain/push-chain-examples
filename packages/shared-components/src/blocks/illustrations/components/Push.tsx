import { FC } from 'react';
import { IllustrationWrapper } from '../IllustrationWrapper';
import { IllustrationProps } from '../Illustrations.types';

const Push: FC<IllustrationProps> = (allProps) => {
  const { svgProps: props, ...restProps } = allProps;
  return (
    <IllustrationWrapper
      componentName="Push"
      illustration={
        <svg
          width={restProps?.width ?? '24'}
          height={restProps?.height ?? '24'}
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          {...props}
        >
            <g clip-path="url(#clip0_47111_22366)">
            <circle cx="12" cy="12" r="12" fill="url(#paint0_radial_47111_22366)"/>
            <g clip-path="url(#clip1_47111_22366)">
            <path d="M6.71281 18.75C6.31936 18.75 6 18.445 6 18.0709V9.54246C6 9.16763 6.31936 8.86338 6.71281 8.86338H8.94588C9.40023 8.86338 9.76898 8.51208 9.76898 8.07923V5.92908C9.76898 5.55504 10.0883 5.25 10.4818 5.25H16.9316C17.521 5.25 18.0008 5.70716 18.0008 6.26862V11.3782C18.0008 11.7522 17.6815 12.0572 17.288 12.0572H15.0549C14.6006 12.0572 14.2318 12.4085 14.2318 12.8414V14.9688C14.2318 15.3428 13.9125 15.6479 13.519 15.6479H10.5921C10.1377 15.6479 9.76898 15.9992 9.76898 16.432V18.0717C9.76898 18.4457 9.44962 18.7508 9.05618 18.7508H6.71281V18.75ZM10.5921 8.84064C10.1377 8.84064 9.76898 9.19194 9.76898 9.6248V11.2731C9.76898 11.7059 10.1377 12.0572 10.5921 12.0572H13.4087C13.8631 12.0572 14.2318 11.7059 14.2318 11.2731V9.6248C14.2318 9.19194 13.8631 8.84064 13.4087 8.84064H10.5921Z" fill="white"/>
            </g>
            </g>
            <defs>
            <radialGradient id="paint0_radial_47111_22366" cx="0" cy="0" r="1" gradientTransform="matrix(25.125 -25.5 23.3178 26.4168 5.25 19.875)" gradientUnits="userSpaceOnUse">
            <stop stop-color="#484AF0"/>
            <stop offset="0.514423" stop-color="#BA39ED"/>
            <stop offset="1" stop-color="#D548EC"/>
            </radialGradient>
            <clipPath id="clip0_47111_22366">
            <rect width="24" height="24" fill="white"/>
            </clipPath>
            <clipPath id="clip1_47111_22366">
            <rect width="12" height="13.5" fill="white" transform="translate(6 5.25)"/>
            </clipPath>
            </defs>
        </svg>
      }
      {...restProps}
    />
  );
};

export default Push;


