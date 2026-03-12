import { Box, Flex, Image, Button, Text } from "@chakra-ui/react";

import logo from "../../../assets/logoplaceholder.png";

export default function Navbar() {
    return (
        <Box
            as="nav"
            display="flex"
            alignItems="center"
            justifyContent="space-between"
            bg="#2b2b2b"
            px="10"
            h="80px"
            position="sticky"
            top="0"
            zIndex="1000"
            overflow="hidden"
        >
            <Flex alignItems="center" gap="3" flexShrink="0">
                <Image
                    src={logo}
                    alt="placeholder"
                    boxSize="50px"
                    objectFit="contain"
                />
                <Text
                    fontSize="xl"
                    fontWeight="600"
                    color="#C2c2c2"
                    whiteSpace="nowrap"
                >
                    SpotifyRecommender
                </Text>
            </Flex>

            <Flex alignItems="center" gap="4" flexShrink="0">
                <Button size="sm">About Us</Button>
                <Button size="sm">Contact Us</Button>
            </Flex>
        </Box>
    );
}